using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace WordQuest.Editor
{
    public static class PanelSettingsAssetBuilder
    {
        private const string AssetPath =
            "Assets/WordQuest/Resources/UI/" +
            "WordQuestPanelSettings.asset";
        private const string ThemePath =
            "Assets/WordQuest/Resources/UI/Styles/" +
            "DefaultRuntimeTheme.tss";

        [MenuItem("Word Quest/Create Panel Settings")]
        public static void CreateOrUpdate()
        {
            var settings =
                AssetDatabase.LoadAssetAtPath<PanelSettings>(AssetPath);
            if (settings == null)
            {
                settings = ScriptableObject.CreateInstance<PanelSettings>();
                settings.name = "WordQuestPanelSettings";
                AssetDatabase.CreateAsset(settings, AssetPath);
            }

            settings.themeStyleSheet =
                AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(ThemePath);
            settings.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            settings.referenceResolution = new Vector2Int(1440, 900);
            settings.screenMatchMode =
                PanelScreenMatchMode.MatchWidthOrHeight;
            settings.match = 0.5f;
            EditorUtility.SetDirty(settings);
            AssetDatabase.SaveAssets();
        }
    }
}
