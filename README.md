# AutoLecture for Maestro

**AutoLecture for Maestro** completely changes how you interact with your online lessons by bringing your AI teacher to life. Instead of just reading text on a screen, AutoLecture dynamically voices your instructor's responses aloud the moment they finish generating. It creates a highly immersive, conversational environment where it truly feels like a teacher is sitting right there, responding to your inputs. Built with a lightning-fast, locally-hosted text-to-speech engine, AutoLecture guarantees complete privacy—your lessons are never downloaded, logged, or sent to the cloud.

## Features
- **Dynamic Bubble Reading**: Intelligently tracks your progress and automatically reads AI chat bubbles and lesson paragraphs aloud as soon as they appear.
- **Code Block Reading**: Extracts and reads syntax from code snippets generated within AI Teacher Prompts while stripping away line numbers for a clean listening experience.
- **Fully Local TTS Engine**: Your voice generation happens completely on-device. No APIs, no cloud services, and no tracking.
- **Data Privacy Guarantee**: AutoLecture operates entirely in real-time system memory. It **never** saves, downloads, or logs your lesson prompts, chat history, or generated audio files.
- **Native Chrome Integration**: Manage playback, pause, skip, and voice model changes directly from the integrated Chrome Extension popup.

## How It Works
AutoLecture is split into two parts:
1. **The Chrome Extension**: Injects a sleek player interface into the Maestro learning platform and intelligently observes the DOM to queue up new AI prompts.
2. **The Local Voice Server**: A lightweight, locally hosted Python API built around `piper-tts` and high-quality ONNX models. It receives the text from the extension and instantly synthesizes natural-sounding speech.

## Installation
The project includes an automated Inno Setup script (`installer.iss`) that dynamically bundles the Python server dependencies, voice models, and Chrome Extension into a clean Windows executable.

1. Download the latest `AutoLecture_for_Maestro_Setup.exe` from the Releases page.
2. Run the installer wizard (which includes an integrated VCL dark mode theme!).
3. The setup will automatically place the Voice Server in your AppData directory and open the setup instructions for loading the Chrome Extension.

*Enjoy your automated, immersive Maestro learning sessions!*
