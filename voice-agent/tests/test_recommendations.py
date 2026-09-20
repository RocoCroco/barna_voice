import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch
from urllib.error import URLError

from tools.recommendations import (
    CatalogueResponse,
    RecommendationSession,
    current_session,
    get_content_details,
    recommend_titles,
    refine_recommendations,
)

RESPONSE = CatalogueResponse.model_validate({
    "status": "ok",
    "items": [{
        "content_type": "movie", "title": "Arrival", "release_year": 2016,
        "genres": ["Science Fiction"], "runtime_minutes": 116, "matched_genre": "Sci-Fi",
    }],
})


class RecommendationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.emit = AsyncMock()
        self.session = RecommendationSession("session", "viewer", "discover", "http://backend", self.emit)
        self.token = current_session.set(self.session)

    async def asyncTearDown(self):
        current_session.reset(self.token)

    async def test_modes_headers_and_structured_event(self):
        for mode, endpoint in [("discover", "preference"), ("consensus", "room"), ("decide", "decide")]:
            self.session.mode = mode
            with patch("tools.recommendations._request", return_value=RESPONSE) as request:
                await recommend_titles("viewer", {})
            url, profile, body = request.call_args.args
            self.assertEqual(url, f"http://backend/api/content/{endpoint}")
            self.assertEqual(profile, "viewer")
            if mode == "decide":
                self.assertEqual(body["count"], 1)
                self.assertEqual(body["content_types"], ["movie"])
                self.assertTrue(body["randomize"])
                self.assertEqual(body["user_id"], "viewer")
            elif mode == "consensus":
                self.assertEqual(body["count"], 8)
                self.assertEqual(body["participants"], [{"user_id": "viewer"}])
            else:
                self.assertEqual(body["count"], 8)
            event = self.emit.call_args.args[0]
            self.assertEqual(event["type"], "recommendations.updated")
            self.assertEqual(event["profileId"], "viewer")
            self.assertEqual(event["sessionId"], "session")
            identifier = event["items"][0]["contentId"]
            self.assertEqual(identifier, '["movie","Arrival",2016,null,null]')
            self.assertEqual(get_content_details(identifier)["title"], "Arrival")
            json.dumps(event, allow_nan=False)

    async def test_refinement_merges_and_can_clear_preferences(self):
        with patch("tools.recommendations._request", return_value=RESPONSE) as request:
            await recommend_titles("viewer", {"genre": "Drama", "duration": 120})
            await refine_recommendations("session", {"genre": "Comedy"})
            self.assertEqual(request.call_args.args[2]["duration"], 120)
            self.assertEqual(request.call_args.args[2]["genre"], "Comedy")
            await refine_recommendations("session", {"duration": None})
            self.assertIsNone(request.call_args.args[2]["duration"])
        self.assertEqual(self.session.revision, 3)

    async def test_subject_query_is_forwarded_and_retained(self):
        with patch("tools.recommendations._request", return_value=RESPONSE) as request:
            await recommend_titles("viewer", {"query": "animals"})
            self.assertEqual(request.call_args.args[2]["query"], "animals")
            await refine_recommendations("session", {"duration": 100})
            self.assertEqual(request.call_args.args[2]["query"], "animals")

    async def test_profile_session_and_cache_isolation(self):
        with patch("tools.recommendations._request", return_value=RESPONSE) as request:
            self.assertIn("error", await recommend_titles("someone-else", {}))
            self.assertIn("error", await refine_recommendations("old-session", {}))
            request.assert_not_called()
            await recommend_titles("viewer", {})
            other = RecommendationSession("other", "other-viewer", "discover", "http://backend", AsyncMock())

            async def other_call():
                token = current_session.set(other)
                try:
                    self.assertIn("error", get_content_details(RESPONSE.items[0].content_id()))
                    await recommend_titles("other-viewer", {"mood": "fun"})
                    self.assertEqual(current_session.get().profile_id, "other-viewer")
                finally:
                    current_session.reset(token)

            await asyncio.gather(other_call(), refine_recommendations("session", {"duration": 100}))
            self.assertEqual(self.session.preferences.duration, 100)
            self.assertEqual(other.preferences.mood, "fun")
            self.assertIsNone(other.preferences.duration)

    async def test_failed_fetch_preserves_candidates_and_reports_error(self):
        with patch("tools.recommendations._request", return_value=RESPONSE):
            await recommend_titles("viewer", {})
        with patch("tools.recommendations._request", side_effect=URLError("offline")):
            result = await refine_recommendations("session", {"genre": "Comedy"})
        self.assertIn("error", result)
        self.assertEqual(self.session.revision, 1)
        self.assertIsNone(self.session.preferences.genre)
        self.assertEqual(get_content_details(RESPONSE.items[0].content_id())["title"], "Arrival")
        self.assertEqual(self.emit.call_args.args[0]["type"], "recommendations.error")

    async def test_decide_does_not_silently_ignore_unsupported_constraints(self):
        self.session.mode = "decide"
        with patch("tools.recommendations._request") as request:
            self.assertIn("error", await refine_recommendations("session", {"duration": 90}))
            request.assert_not_called()
