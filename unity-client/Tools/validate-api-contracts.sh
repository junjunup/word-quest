#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "$project_root/.." && pwd)"
routes_file="$project_root/Assets/WordQuest/Runtime/Infrastructure/Api/ApiRoutes.cs"
learning_dtos="$project_root/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/LearningDtos.cs"
pronunciation_dtos="$project_root/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/PronunciationDtos.cs"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

test -f "$routes_file" || fail "Missing ApiRoutes.cs"

groups=(
  auth
  game
  vocab
  learning
  daily-challenge
  social
  pronunciation
  chat
)

for group in "${groups[@]}"; do
  rg -F "\"/api/$group/" "$routes_file" >/dev/null ||
    fail "Unity routes do not cover /api/$group/"
done

server_routes=(
  "auth.js:/register"
  "auth.js:/login"
  "auth.js:/me"
  "game.js:/progress"
  "game.js:/leaderboard"
  "game.js:/achievements"
  "game.js:/daily-reward"
  "game.js:/character"
  "game.js:/levels-status"
  "game.js:/endless-score"
  "vocabulary.js:/stats"
  "vocabulary.js:/import"
  "vocabulary.js:/wordbooks"
  "vocabulary.js:/source-manifest"
  "vocabulary.js:/chapter/:chapter"
  "vocabulary.js:/quiz/:wordId"
  "vocabulary.js:/search"
  "learning.js:/review/today"
  "learning.js:/quiz-record"
  "learning.js:/mastery/summary"
  "learning.js:/mastery/words"
  "learning.js:/review/sessions"
  "learning.js:/stats"
  "learning.js:/error-types"
  "learning.js:/daily-stats"
  "learning.js:/chapter-stats"
  "learning.js:/top-mistakes"
  "learning.js:/heatmap"
  "dailyChallenge.js:/today"
  "dailyChallenge.js:/:id/submit"
  "dailyChallenge.js:/leaderboard"
  "social.js:/users/search"
  "social.js:/friends"
  "social.js:/friends/request"
  "social.js:/challenges"
  "pronunciation.js:/score"
  "pronunciation.js:/history"
  "chat.js:/message"
  "chat.js:/stream"
)

for contract in "${server_routes[@]}"; do
  file="${contract%%:*}"
  route="${contract#*:}"
  rg -F "'$route'" "$repo_root/server/src/routes/$file" >/dev/null ||
    fail "Express route missing: $file $route"
done

if rg -n 'https?://' "$routes_file" >/dev/null; then
  fail "ApiRoutes must not contain an environment-specific origin"
fi

rg -F "AdaptiveDifficultyDto adaptiveDifficulty" "$learning_dtos" >/dev/null ||
  fail "quiz-record adaptiveDifficulty must remain an object DTO"
rg -F "string[] feedback" "$pronunciation_dtos" >/dev/null ||
  fail "pronunciation details.feedback must remain a string array"

echo "Unity API contract validation PASS"
