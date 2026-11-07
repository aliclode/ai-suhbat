# NOVA + VoiceStudio speech integration

This branch adds an optional VoiceStudio speech provider to NOVA. Existing Gemini/Groq STT and Edge TTS remain available as fallbacks.

## Configure the VoiceStudio service

Deploy VoiceStudio separately on a machine/service that can run its Python speech backend and required models. Do not point this setting at the GitHub repository URL or the VoiceStudio website.

Set these environment variables on the NOVA service:

- `VOICESTUDIO_URL`: HTTPS service root for your VoiceStudio backend, without `/v1`.
- `VOICESTUDIO_API_KEY`: optional bearer token if the VoiceStudio backend has API authentication enabled.
- `VOICESTUDIO_STT_MODEL`: optional active transcription engine id; default `whisper-1`.
- `VOICESTUDIO_TTS_MODEL`: optional active speech engine id; default `tts-1`.

VoiceStudio documents OpenAI-compatible routes at `POST /v1/audio/transcriptions`, `POST /v1/audio/speech`, and `GET /v1/audio/voices`. The selected STT engine must be active on the VoiceStudio service. Uzbek recognition depends on the active transcription model; use a multilingual Whisper-family model such as large-v3 and test with Uzbek audio before relying on it. TTS voice availability and Uzbek pronunciation depend on the installed TTS engine and voice profile.

## Runtime behavior

- If `VOICESTUDIO_URL` is unset, NOVA behaves as before.
- If VoiceStudio STT or TTS fails, NOVA logs a warning and falls back to its existing provider.
- VoiceStudio voice profiles are loaded into the voice modal when the service is configured.
- The voice modal passes the selected profile, speed, and optional style instruction to VoiceStudio.
- VoiceStudio is a speech provider only; NOVA's Gemini/Groq agent remains the conversation engine.

## License

VoiceStudio is distributed under AGPL-3.0-only. This integration calls its documented HTTP API and does not copy VoiceStudio source files into NOVA. If VoiceStudio source code is later copied, modified, or distributed with NOVA, review and comply with the applicable AGPL obligations and notices.
