import json
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import yaml
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.frames.frames import OutputTransportMessageFrame
from pipecat.runner.types import RunnerArguments
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transports.base_output import BaseOutputTransport
from pipecat.transports.base_transport import BaseTransport
from pydantic import BaseModel, Field, ValidationError

from tools.recommendations import (
    RecommendationSession,
    current_session,
    get_content_details,
    recommend_titles,
    refine_recommendations,
)


class SessionContext(BaseModel):
    sessionId: str = Field(min_length=1, max_length=128)
    profileId: str = Field(min_length=1, max_length=256)
    mode: Literal["discover", "consensus", "decide"]


class ToolInput(BaseModel):
    properties: dict[str, object]
    required: list[str]


class ToolDefinition(BaseModel):
    description: str
    input: ToolInput


class RecommendArguments(BaseModel):
    profile_id: str
    session_preferences: dict[str, object]


class RefineArguments(BaseModel):
    session_id: str
    changes: dict[str, object]


class DetailArguments(BaseModel):
    content_id: str


async def recommendation_handler(params: FunctionCallParams) -> None:
    try:
        if params.function_name == "recommend_titles":
            arguments = RecommendArguments.model_validate(params.arguments)
            result = await recommend_titles(arguments.profile_id, arguments.session_preferences)
        elif params.function_name == "refine_recommendations":
            changes = RefineArguments.model_validate(params.arguments)
            result = await refine_recommendations(changes.session_id, changes.changes)
        else:
            details = DetailArguments.model_validate(params.arguments)
            result = get_content_details(details.content_id)
    except ValidationError:
        result = {"error": "Invalid tool arguments. Correct them before retrying."}
    await params.result_callback(result)


def recommendation_tools() -> list[FunctionSchema]:
    schemas = []
    for name in ("recommend_titles", "refine_recommendations", "get_content_details"):
        source = Path(__file__).parent / "tools" / f"{name}.yaml"
        definition = ToolDefinition.model_validate(yaml.safe_load(source.read_text(encoding="utf-8")))
        schemas.append(FunctionSchema(
            name=name, description=definition.description,
            properties=definition.input.properties, required=definition.input.required,
            handler=recommendation_handler,
        ))
    return schemas


@asynccontextmanager
async def recommendation_session(
    transport: BaseTransport, runner_args: RunnerArguments,
) -> AsyncIterator[None]:
    context = SessionContext.model_validate(runner_args.body)
    output = transport.output()
    if not isinstance(output, BaseOutputTransport):
        raise TypeError("Compass requires an output transport with a data channel.")

    async def emit(event: dict[str, object]) -> None:
        await output.send_message(OutputTransportMessageFrame(
            message={"label": "rtvi-ai", "type": "server-message", "data": event},
        ))

    session = RecommendationSession(
        session_id=context.sessionId, profile_id=context.profileId, mode=context.mode,
        backend_url=os.environ.get("BACKEND_URL", "http://localhost:8000"), emit=emit,
    )
    token = current_session.set(session)
    try:
        yield
    finally:
        session.items.clear()
        current_session.reset(token)


def session_prompt() -> str:
    session = current_session.get()
    return "\nActive session context (use these exact IDs in tools):\n" + json.dumps({
        "profile_id": session.profile_id, "session_id": session.session_id, "mode": session.mode,
    })
