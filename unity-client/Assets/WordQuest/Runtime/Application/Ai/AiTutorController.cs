using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Application.Ai
{
    public sealed class ChatContext
    {
        public string CurrentWord { get; set; } = string.Empty;
        public int PlayerLevel { get; set; } = 1;
        public int CorrectStreak { get; set; }
        public int WrongStreak { get; set; }
        public string ChapterName { get; set; } = string.Empty;
        public string TriggerType { get; set; } = "manual";
        public string CorrectAnswer { get; set; } = string.Empty;
        public string PlayerAnswer { get; set; } = string.Empty;
        public string AnswerQuality { get; set; } = string.Empty;
        public int EditDistance { get; set; }
        public float Similarity { get; set; }
        public string FuzzyFeedback { get; set; } = string.Empty;
    }

    public sealed class AiTutorController
    {
        private readonly IChatService chat;

        public AiTutorController(IChatService chat)
        {
            this.chat = chat ?? throw new ArgumentNullException(nameof(chat));
        }

        public async Task SendAsync(
            string message,
            ChatContext context,
            Action<string> onTextChanged,
            CancellationToken token)
        {
            message = message?.Trim();
            if (string.IsNullOrEmpty(message))
                throw new ArgumentException("消息不能为空", nameof(message));
            if (message.Length > 1000)
                throw new ArgumentException("消息最多 1000 个字符", nameof(message));
            if (onTextChanged == null)
                throw new ArgumentNullException(nameof(onTextChanged));

            context = context ?? new ChatContext();
            var fullText = new StringBuilder();
            try
            {
                await chat.StreamAsync(
                    new ChatRequest
                    {
                        message = message,
                        context = new ChatContextDto
                        {
                            currentWord = context.CurrentWord,
                            playerLevel = context.PlayerLevel,
                            correctStreak = context.CorrectStreak,
                            wrongStreak = context.WrongStreak,
                            chapterName = context.ChapterName,
                            triggerType = context.TriggerType,
                            correctAnswer = context.CorrectAnswer,
                            playerAnswer = context.PlayerAnswer,
                            answerQuality = context.AnswerQuality,
                            editDistance = context.EditDistance,
                            similarity = context.Similarity,
                            fuzzyFeedback = context.FuzzyFeedback
                        }
                    },
                    delta =>
                    {
                        fullText.Append(delta);
                        onTextChanged(fullText.ToString());
                    },
                    token);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                if (fullText.Length > 0)
                {
                    fullText.Append("\n\n（连接中断，已保留上面的部分回答，可点击重试。）");
                    onTextChanged(fullText.ToString());
                    return;
                }

                onTextChanged(
                    $"AI 学习导师暂时无法回答：{Readable(exception.Message)}");
            }
        }

        private static string Readable(string message)
        {
            if (string.IsNullOrWhiteSpace(message))
                return "服务暂时不可用，请稍后重试。";
            return message.Length <= 180
                ? message
                : message.Substring(0, 180) + "…";
        }
    }
}
