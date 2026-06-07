from collections.abc import Iterator

import numpy as np


DEFAULT_SAMPLE_RATE = 24000


class MLXQwen3TTSModelWrapper:
    def __init__(self, model_id: str):
        from mlx_audio.tts.utils import load_model

        self.model = load_model(model_id)
        self.model_id = model_id

    def _get_sample_rate(self, result) -> int:
        return int(
            getattr(result, "sample_rate", None)
            or getattr(result, "_sample_rate", None)
            or getattr(result, "sampling_rate", None)
            or DEFAULT_SAMPLE_RATE
        )

    def _finalize(self, results) -> tuple[list[np.ndarray], int]:
        chunks = list(results)
        if not chunks:
            raise RuntimeError(f"No audio returned by MLX-Audio for {self.model_id}")

        final = chunks[-1]
        audio = np.asarray(final.audio, dtype=np.float32)
        return [audio], self._get_sample_rate(final)

    def generate_custom_voice(self, **kwargs) -> tuple[list[np.ndarray], int]:
        return self._finalize(self.model.generate_custom_voice(**kwargs))

    def generate_voice_clone(self, **kwargs) -> tuple[list[np.ndarray], int]:
        kwargs.pop("x_vector_only_mode", None)
        return self._finalize(self.model.generate(**kwargs))

    def generate_voice_design(self, **kwargs) -> tuple[list[np.ndarray], int]:
        return self._finalize(self.model.generate_voice_design(**kwargs))

    def stream_generate_voice_clone(
        self,
        streaming_interval: float = 0.5,
        **kwargs,
    ) -> Iterator[tuple[np.ndarray, int]]:
        """Yield PCM chunks as they are generated using mlx_audio's native streaming.

        Calls generate() once with stream=True so the KV cache and reference audio
        encoding happen only once for the full text, unlike the text-splitting approach.
        """
        kwargs.pop("x_vector_only_mode", None)
        results = self.model.generate(
            **kwargs,
            stream=True,
            streaming_interval=streaming_interval,
        )
        for result in results:
            if result.audio is None:
                continue
            audio = np.asarray(result.audio, dtype=np.float32)
            if audio.size == 0:
                continue
            yield audio, self._get_sample_rate(result)
