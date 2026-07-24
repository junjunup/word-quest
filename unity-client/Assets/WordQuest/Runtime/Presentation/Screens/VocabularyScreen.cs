using System;
using System.IO;
using System.Threading;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    [Serializable]
    internal sealed class VocabularyImportFile
    {
        public WordDto[] words;
        public string wordbookId;
        public string wordbookName;
    }

    public sealed class VocabularyScreen
    {
        private readonly VisualElement view;
        private readonly IVocabularyService vocabulary;
        private readonly WordQuestContext context;
        private readonly CancellationToken token;
        private readonly Action<string> wordbookSelected;
        private VocabularyImportRequest pendingImport;

        public VocabularyScreen(
            VisualElement view,
            IVocabularyService vocabulary,
            WordQuestContext context,
            CancellationToken token,
            Action pronunciation = null,
            Action<string> wordbookSelected = null)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.vocabulary = vocabulary ??
                              throw new ArgumentNullException(nameof(vocabulary));
            this.context = context ??
                           throw new ArgumentNullException(nameof(context));
            this.token = token;
            this.wordbookSelected = wordbookSelected;
            view.Q<Button>("vocab-refresh-button").clicked += Load;
            view.Q<Button>("vocab-dry-run-button").clicked += DryRun;
            view.Q<Button>("vocab-confirm-button").clicked += Confirm;
            view.Q<Button>("source-manifest-button").clicked += LoadManifest;
            view.Q<Button>("open-pronunciation-button").clicked += () =>
                pronunciation?.Invoke();
            Load();
        }

        private async void Load()
        {
            var wordbooks = await vocabulary.GetWordbooksAsync(token);
            var list = view.Q<ScrollView>("wordbook-list");
            list.Clear();
            if (!wordbooks.IsSuccess)
            {
                list.Add(new Label(wordbooks.Message));
                return;
            }

            foreach (var wordbook in wordbooks.Data ??
                                     Array.Empty<WordbookDto>())
            {
                var captured = wordbook;
                var button = new Button(() =>
                {
                    context.Settings.WordbookId = captured.wordbookId;
                    context.NotifySettingsChanged();
                    this.wordbookSelected?.Invoke(captured.wordbookId);
                    view.Q<Label>("vocab-status-label").text =
                        $"已选择 {captured.name}";
                })
                {
                    text =
                        $"{wordbook.name}\n{wordbook.total} 词 · {wordbook.chapters?.Length ?? 0} 章"
                };
                button.AddToClassList("list-card");
                list.Add(button);
            }
        }

        private async void DryRun()
        {
            var path = view.Q<TextField>("import-path-field").value?.Trim();
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
            {
                Status("找不到导入文件。请输入完整 JSON 文件路径。");
                return;
            }

            try
            {
                var source = JsonUtility.FromJson<VocabularyImportFile>(
                    File.ReadAllText(path));
                if (source?.words == null || source.words.Length == 0)
                {
                    Status("导入文件必须是包含 words 数组的 JSON 对象。");
                    return;
                }

                pendingImport = new VocabularyImportRequest
                {
                    words = source.words,
                    dryRun = true,
                    wordbookId = string.IsNullOrWhiteSpace(source.wordbookId)
                        ? context.Settings.WordbookId
                        : source.wordbookId,
                    wordbookName = source.wordbookName
                };
                var result = await vocabulary.ImportAsync(pendingImport, token);
                view.Q<Button>("vocab-confirm-button").SetEnabled(result.IsSuccess);
                Status(result.IsSuccess ? "校验通过，可以确认导入。" : result.Message);
            }
            catch (Exception exception)
            {
                Status($"无法读取导入文件：{exception.Message}");
            }
        }

        private async void Confirm()
        {
            if (pendingImport == null)
                return;
            var button = view.Q<Button>("vocab-confirm-button");
            button.SetEnabled(false);
            pendingImport.dryRun = false;
            var result = await vocabulary.ImportAsync(pendingImport, token);
            Status(result.IsSuccess
                ? $"已导入 {result.Data.imported} 个词"
                : result.Message);
            if (result.IsSuccess)
                Load();
        }

        private async void LoadManifest()
        {
            var result = await vocabulary.GetSourceManifestAsync(token);
            Status(result.IsSuccess
                ? $"词库来源：{result.Data.sourceRepository}\n{result.Data.sourceNote}"
                : result.Message);
        }

        private void Status(string message)
        {
            view.Q<Label>("vocab-status-label").text = message;
        }
    }
}
