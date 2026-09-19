"""Small audio batching adapter for SLNG's Unmute STT bridge.

SmallWebRTC emits one audio frame every twenty milliseconds. Sending every
frame as its own WebSocket message exceeds SLNG's two-thousand-message per-minute
window after roughly forty seconds. Pairing adjacent frames keeps streaming
latency low while staying below the bridge's per-minute message limit.
"""

from collections.abc import AsyncGenerator

from pipecat.frames.frames import Frame, VADUserStoppedSpeakingFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat_slng import SlngSTTService


class BatchedSlngSTTService(SlngSTTService):
    """Send two adjacent audio frames in each SLNG WebSocket message."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._compass_audio_batch = bytearray()
        self._compass_audio_frame_count = 0

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame | None, None]:
        self._compass_audio_batch.extend(audio)
        self._compass_audio_frame_count += 1

        if self._compass_audio_frame_count < 2:
            yield None
            return

        batched_audio = self._take_audio_batch()
        async for frame in super().run_stt(batched_audio):
            yield frame

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        # Preserve the final twenty milliseconds before asking SLNG to finalize.
        if isinstance(frame, VADUserStoppedSpeakingFrame) and self._compass_audio_batch:
            await self.process_generator(super().run_stt(self._take_audio_batch()))

        await super().process_frame(frame, direction)

    def _take_audio_batch(self) -> bytes:
        audio = bytes(self._compass_audio_batch)
        self._compass_audio_batch.clear()
        self._compass_audio_frame_count = 0
        return audio
