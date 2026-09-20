import asyncio
import json
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class Participant(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str | None = None
    genre: str | None = None
    duration: int | None = Field(default=None, gt=0)
    mood: str | None = None
    query: str | None = None


class Preferences(Participant):
    content_types: list[Literal["movie", "show", "sport"]] | None = None
    participants: list[Participant] | None = None


class CatalogueItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    content_type: Literal["movie", "show", "sport"]
    title: str
    genres: list[str]
    runtime_minutes: int | None
    matched_genre: str | None = None
    release_year: int | None = None
    poster_path: str | None = None
    backdrop_path: str | None = None
    synopsis: str | None = None
    air_date: str | None = None
    match_date: str | None = None
    channel: str | None = None
    start_time: str | None = None
    kickoff_cet: str | None = None

    def content_id(self) -> str:
        date = self.air_date if self.air_date is not None else self.match_date
        return json.dumps([
            self.content_type, self.title,
            self.release_year if self.release_year is not None else date,
            self.channel, self.start_time if self.start_time is not None else self.kickoff_cet,
        ], ensure_ascii=False, separators=(",", ":"))


class CatalogueResponse(BaseModel):
    items: list[CatalogueItem]
    status: str


def _request(url: str, profile_id: str, body: dict[str, object]) -> CatalogueResponse:
    request = Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "X-Profile-Id": profile_id},
    )
    with urlopen(request, timeout=15) as response:
        return CatalogueResponse.model_validate_json(response.read())


def _criteria(preferences: Preferences) -> list[str]:
    criteria = []
    for entry in [preferences, *(preferences.participants or [])]:
        if entry.genre:
            criteria.append(entry.genre)
        if entry.duration:
            criteria.append(f"Up to {entry.duration} minutes")
        if entry.mood:
            criteria.append(entry.mood)
        if entry.query:
            criteria.append(entry.query)
    criteria.extend(preferences.content_types or [])
    return list(dict.fromkeys(criteria))


@dataclass
class RecommendationSession:
    session_id: str
    profile_id: str
    mode: Literal["discover", "consensus", "decide"]
    backend_url: str
    emit: Callable[[dict[str, object]], Awaitable[None]]
    preferences: Preferences = field(default_factory=Preferences)
    items: dict[str, CatalogueItem] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    revision: int = 0

    async def recommend(self, changes: object) -> dict[str, object]:
        async with self.lock:
            try:
                update = Preferences.model_validate(changes)
                preferences = Preferences.model_validate({
                    **self.preferences.model_dump(), **update.model_dump(exclude_unset=True),
                })
                participants = preferences.participants or [Participant(user_id=self.profile_id)]
                if preferences.user_id not in (None, self.profile_id) or any(
                    entry.user_id not in (None, self.profile_id) for entry in participants
                ):
                    raise ValueError("Only the active profile or anonymous room participants may be used.")
                common: dict[str, object] = {"count": 8, "content_types": preferences.content_types}
                if self.mode == "decide":
                    if preferences.genre or preferences.duration or preferences.mood or preferences.query:
                        raise ValueError("Decide chooses one surprise movie without filters. Use Discover for specific preferences.")
                    endpoint = "decide"
                    body = {
                        "count": 1, "content_types": ["movie"],
                        "randomize": True, "user_id": self.profile_id,
                    }
                    criteria = ["One surprise movie"]
                elif self.mode == "consensus":
                    endpoint = "room"
                    shared = preferences.model_dump(
                        include={"genre", "duration", "mood", "query"}, exclude_none=True,
                    )
                    body = {
                        **common,
                        "participants": [
                            {**entry.model_dump(exclude_none=True), **shared} for entry in participants
                        ],
                    }
                    criteria = _criteria(preferences)
                else:
                    endpoint = "preference"
                    body = {
                        **common, "genre": preferences.genre,
                        "duration": preferences.duration, "mood": preferences.mood,
                        "query": preferences.query,
                    }
                    criteria = _criteria(preferences)
                response = await asyncio.to_thread(
                    _request, f"{self.backend_url.rstrip('/')}/api/content/{endpoint}",
                    self.profile_id, body,
                )
            except (ValidationError, ValueError, HTTPError, URLError, TimeoutError) as error:
                message = str(error) if isinstance(error, ValueError) and not isinstance(error, ValidationError) else (
                    "Recommendations are unavailable. Check the preferences or try again."
                )
                await self.emit({
                    "type": "recommendations.error", "sessionId": self.session_id,
                    "profileId": self.profile_id, "message": message,
                })
                return {"error": message}

            self.preferences = preferences
            self.revision += 1
            self.items.update((item.content_id(), item) for item in response.items)
            message = (
                "Here is my pick for you."
                if self.mode == "decide" and response.items
                else "Here are your picks. What would you like to change?"
                if response.items
                else "No titles matched. What can we change?"
            )
            event: dict[str, object] = {
                "type": "recommendations.updated",
                "sessionId": self.session_id, "profileId": self.profile_id,
                "revision": self.revision, "message": message, "criteria": criteria,
                "items": [
                    {
                        "contentId": item.content_id(),
                        "score": 1 / (index + 1),
                        "reason": f"Matches {item.matched_genre}." if item.matched_genre else "Selected by the recommendation service.",
                    }
                    for index, item in enumerate(response.items)
                ],
                "catalog": [item.model_dump(mode="json") for item in response.items],
            }
            await self.emit(event)
            return {
                "session_id": self.session_id, "message": message, "criteria": criteria,
                "status": response.status,
                "items": [{"content_id": item.content_id(), **item.model_dump(mode="json")} for item in response.items],
            }


current_session: ContextVar[RecommendationSession] = ContextVar("compass_recommendation_session")


async def recommend_titles(profile_id: str, session_preferences: object) -> dict[str, object]:
    session = current_session.get()
    if profile_id != session.profile_id:
        return {"error": "Use the active profile from the session context."}
    return await session.recommend(session_preferences)


async def refine_recommendations(session_id: str, changes: object) -> dict[str, object]:
    session = current_session.get()
    if session_id != session.session_id:
        return {"error": "Use the current session ID."}
    return await session.recommend(changes)


def get_content_details(content_id: str) -> dict[str, object]:
    item = current_session.get().items.get(content_id)
    if item is None:
        return {"error": "This title is not cached in the current session."}
    return {"content_id": content_id, **item.model_dump(mode="json")}
