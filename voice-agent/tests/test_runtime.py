import unittest
from unittest.mock import AsyncMock, create_autospec, patch

from compass_session import recommendation_session, recommendation_tools, session_prompt
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
