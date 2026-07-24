using System;
using System.Text;
using UnityEngine.Networking;

namespace WordQuest.Infrastructure.Api
{
    public sealed class SseDownloadHandler : DownloadHandlerScript
    {
        private readonly Action<string> onData;
        private readonly StringBuilder buffer = new StringBuilder();
        private readonly Decoder decoder = Encoding.UTF8.GetDecoder();

        public SseDownloadHandler(Action<string> onData)
            : base(new byte[4096])
        {
            this.onData = onData ??
                          throw new ArgumentNullException(nameof(onData));
        }

        protected override bool ReceiveData(byte[] data, int dataLength)
        {
            if (data == null || dataLength <= 0)
                return false;

            var charCount = decoder.GetCharCount(data, 0, dataLength);
            var chars = new char[charCount];
            decoder.GetChars(data, 0, dataLength, chars, 0);
            buffer.Append(chars);
            DrainEvents();
            return true;
        }

        protected override void CompleteContent()
        {
            if (buffer.Length > 0)
            {
                buffer.Append("\n\n");
                DrainEvents();
            }
        }

        private void DrainEvents()
        {
            while (true)
            {
                var text = buffer.ToString();
                var boundary = text.IndexOf("\n\n", StringComparison.Ordinal);
                var separatorLength = 2;
                if (boundary < 0)
                {
                    boundary = text.IndexOf("\r\n\r\n", StringComparison.Ordinal);
                    separatorLength = 4;
                }

                if (boundary < 0)
                    return;

                var block = text.Substring(0, boundary);
                buffer.Remove(0, boundary + separatorLength);
                Emit(block);
            }
        }

        private void Emit(string block)
        {
            var lines = block.Replace("\r\n", "\n").Split('\n');
            var payload = new StringBuilder();
            foreach (var line in lines)
            {
                if (!line.StartsWith("data:", StringComparison.Ordinal))
                    continue;
                if (payload.Length > 0)
                    payload.Append('\n');
                payload.Append(line.Substring(5).TrimStart());
            }

            var value = payload.ToString();
            if (value.Length > 0 && value != "[DONE]")
                onData(value);
        }
    }
}
