#!/bin/bash
# Auto-update yt-dlp
# Add to crontab with: crontab -e
# Run daily at 3am: 0 3 * * * /path/to/sarcastic-music/scripts/update-ytdlp.sh

YTDLP="/opt/homebrew/bin/yt-dlp"
LOG="/tmp/ytdlp-update.log"

echo "$(date): Checking for yt-dlp update..." >> "$LOG"
$YTDLP -U >> "$LOG" 2>&1
echo "$(date): Done. Version: $($YTDLP --version)" >> "$LOG"
