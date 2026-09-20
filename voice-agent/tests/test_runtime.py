import unittest
from unittest.mock import AsyncMock, create_autospec, patch

from compass_session import (
    recommendation_session,
    recommendation_tools,
    session_prompt,
    session_startup_message,
)
from pipecat.runner.types import RunnerArguments
from pipecat.transports.base_output import BaseOutputTransport
from pipecat.transports.base_transport import BaseTransport

from tools.recommendations import CatalogueResponse, current_session, recommend_titles


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_context_lifetime_and_rtvi_envelope(self):
        transport = create_autospec(BaseTransport, instance=True)
        output = create_autospec(BaseOutputTransport, instance=True)
        output.send_message = AsyncMock()
        transport.output.return_value = output
        arguments = RunnerArguments(body={
            "profileId": "viewer", "sessionId": "session", "mode": "discover",
        })
        async with recommendation_session(transport, arguments):
            self.assertIn('"profile_id": "viewer"', session_prompt())
            self.assertIn("at most two useful questions", session_prompt())
            session = current_session.get()
            with patch("tools.recommendations._request", return_value=CatalogueResponse(status="ok", items=[])):
                await recommend_titles("viewer", {})
            frame = output.send_message.call_args.args[0]
            self.assertEqual(frame.message["label"], "rtvi-ai")
            self.assertEqual(frame.message["type"], "server-message")
            self.assertEqual(frame.message["data"]["sessionId"], "session")
            self.assertEqual(frame.message["data"]["type"], "recommendations.updated")
        self.assertEqual(session.items, {})
        with self.assertRaises(LookupError):
            current_session.get()

    async def test_generated_tools_retain_nested_yaml_schemas(self):
        schemas = {schema.name: schema.to_default_dict() for schema in recommendation_tools()}
        properties = schemas["recommend_titles"]["parameters"]["properties"]
        self.assertIn("duration", properties["session_preferences"]["properties"])
        self.assertIn("participants", properties["session_preferences"]["properties"])
        self.assertIn("query", properties["session_preferences"]["properties"])

    async def test_mode_specific_startup_messages(self):
        session = current_session.get(None)
        self.assertIsNone(session)

        from tools.recommendations import RecommendationSession
        discover = RecommendationSession("s", "viewer", "discover", "http://backend", AsyncMock())
        token = current_session.set(discover)
        try:
            self.assertIn("mood", await session_startup_message())
            discover.mode = "consensus"
            self.assertIn("How many people", await session_startup_message())
            discover.mode = "decide"
            with patch("tools.recommendations._request") as request:
                from tools.recommendations import CatalogueResponse
                request.return_value = CatalogueResponse.model_validate({
                    "status": "success",
                    "items": [{
                        "content_type": "movie", "title": "Arrival",
                        "genres": ["Science Fiction"], "runtime_minutes": 116,
                        "matched_genre": None, "synopsis": "A linguist meets mysterious visitors.",
                    }],
                })
                self.assertIn("I picked Arrival", await session_startup_message())
        finally:
            current_session.reset(token)
