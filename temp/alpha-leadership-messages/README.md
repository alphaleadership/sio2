# Alpha Leadership Messages

This project serves as a front-end application for displaying messages organized by server and channel for Alpha Leadership. The messages are fetched from JSON files that are structured by date.

## Project Structure

```
alpha-leadership-messages
├── src
│   ├── index.html          # Main HTML file for the application
│   ├── scripts
│   │   └── main.js        # JavaScript file for fetching and displaying messages
│   ├── styles
│   │   └── style.css      # CSS file for styling the application
│   └── data
│       └── 2024-06-13.json # JSON file containing messages for June 13, 2024
└── README.md              # Documentation for the project
```

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd alpha-leadership-messages
   ```

2. **Open the project**:
   Open `src/index.html` in your web browser to view the application.

3. **Modify Messages**:
   To add or modify messages, edit the JSON files located in the `src/data` directory. Each file should be named with the date in the format `YYYY-MM-DD.json`.

## Functionality

- The application fetches messages from the JSON files and displays them organized by server and channel.
- Each message includes the text, timestamp, server, and channel information.
- The layout is responsive and designed for easy readability.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.