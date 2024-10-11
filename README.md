# Technical Phone Screen using the OpenAI Realtime API

This project is a **Technical Phone Screen app** that leverages the **OpenAI Realtime API** to conduct simulated interviews with real-time audio transcription. The app processes input speech, sends it to the OpenAI API, and provides transcriptions, making it a useful tool for practicing technical interviews.

<img src="/readme/screenshot.png" width="800" />

## Features
- Real-time audio transcription using the OpenAI Realtime API.
- Simulates a technical phone interview with customizable candidate name and difficulty levels.
- OpenAI Whisper model used for accurate transcription.

## Demo

You can see the app [here](https://actamachina.com/technical-phone-screen). Since the OpenAI Realtime API costs are approximately **24c per minute**, you will need to supply your own API key.

## Requirements

- Node.js
- OpenAI API key (You can get one [here](https://platform.openai.com/account/api-keys))

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/tlyleung/technical-phone-screen.git
    cd technical-phone-screen
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Run the development server**:
    ```bash
    npm run dev
    ```

4. **Open the app**:
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter your **OpenAI API Key** in the input field.
2. Customize your interview settings, such as the **candidate name** and **difficulty level**.
3. Start the interview by clicking the "Start" button.
4. Open the browser console to see the real-time transcription.

## Cost Notice

Be aware that using the OpenAI Realtime API incurs costs at approximately **24c per minute**. You will need your own API key to use this app.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

## License

This project is licensed under the GNU General Public License v3.0 License. See the [LICENSE](LICENSE) file for more details.
