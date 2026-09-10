# Unity 自动遇敌与 P0/P1 开发交接

日期：2026-09-10。用户明确要求修改 Unity 版本。

> 历史阶段记录：下文“剩余 P0/P1”与“纠正仅本地处理”描述的是第一轮交付。后续实现和最新验证见 [P0/P1 修复交接](2026-09-10-p0-p1-closure.md)。

## 工程与边界

- 仓库：`/Users/sxh/Documents/Codex/2026-07-24/wo/word-quest/.worktrees/unity-blind-review-optimization`。
- 工程：上述仓库的 `unity-client/`；分支 `codex/unity-blind-review-optimization`；起点 `7b6dbd8`。
- 当前是 Unity 遇敌与答题反馈的第一轮交付，不代表完整 P0/P1 完成。
- 当前 `/Users/sxh/Documents/ChatGPT/game` 是另一份网页仓库。此前误做的网页修改尚未提交，不作为 Unity 验收证据；未整体回滚，以免覆盖同目录其他工作。
- Unity 工程已有 Sprout 素材 `.meta` 修改和 PackageManagerSettings，本轮保留。无提交、合并、推送、部署或付费生成。

## 已实施

1. 普通怪物由 WorldController 每帧集中选择：1.5 世界单位内、存活、视线无遮挡的最近目标；同距离按稳定 ID。此工程没有 Tilemap，1 世界单位作为当前地图格基准，不按屏幕像素判断。
2. 普通怪物移除独立碰撞触发旁路；NPC 和 Boss 保留已有接触机制。自动遇敌立即关闭移动、清除玩家速度、暂停角色动画及 Boss 行为，避免多怪抢题。
3. 普通答题不显示失败倒计时，上报 timeLimit=0，仍记录作答用时；提示拼写上报 hintUsed。选项不足四个时改用无提示拼写，不填入虚构干扰项。
4. 普通首答错误不扣生命；展示词库中的正确答案、释义和可用例句，提供一次纠正或“稍后复习”。纠正正确可以清除当前怪物，不改写首答错误、正确数或游戏分；再次纠正不重复清怪。当前纠正只在本地处理，未单独写入服务端纠正记录。
5. 正确反馈关闭后才清怪；最后一怪也在反馈完成后结算。保存失败保持当前词，不按客户端答案发奖或推进；显示重试和退出。
6. 结束遭遇后提供 1.5 秒保护提示；取消目标还需离开到 2 世界单位外才重新布防。恢复模拟不再重置这项限制。保护期拒绝 Boss 伤害回调。
7. 流程关闭后忽略迟到答题结果；限制重复提交。修复同步反馈被旧答题弹窗 Hide 覆盖的问题。
8. 暂停期间 Boss 弹幕的移动与碰撞回收均停止。
9. 怪物首次出题后绑定该词，答错离开后再接近仍练习原词；Boss 保存失败支持重试或退出本关。

## 实际验证

- `bash unity-client/Tools/validate-project.sh`：PASS，包含 C# 结构、UXML、项目版本和功能清单校验。
- `bash unity-client/Tools/run-unity-tests.sh all`：Unity 6000.5.3f1，EditMode **161/161**，PlayMode **18/18**。
- 新增测试先复现了靠近不触发、暂停残留速度、恢复立即重触发、普通答错扣血、关闭后迟到发奖、暂停弹幕回收；实现后通过。
- 另覆盖障碍遮挡、无计时 UI、选项不足、纠正不改首答和分数、重复纠正、反馈后清怪、服务保存失败。
- XML：`unity-client/TestResults/EditMode.xml`、`unity-client/TestResults/PlayMode.xml`。
- 以 Unity 6000.5.3f1 执行 `-batchmode -nographics -projectPath unity-client -executeMethod WordQuest.Editor.BuildCommand.BuildMacOS -quit`：退出码 0。
- `bash unity-client/Tools/smoke-macos-player.sh`：PASS，真实 Player 完成无界面启动，非完整人工通关验收。
- macOS 应用：`unity-client/Builds/macOS/WordQuest.app`。Universal x86_64/arm64 校验和 `codesign --verify --deep --strict` 通过。
- 本轮 C#、测试和 UXML 范围 `git diff --check` 通过；全仓库检查仍会报告原有素材导入 `.meta` 的尾随空格，未清理这些素材修改。

## 未覆盖与剩余 P0/P1

不能把 Unity 自动化测试和启动检查等同于完整人工体验验收。可见窗口操作、中文输入法、手柄、按住移动键后关闭弹窗、后台恢复及完整关卡走查仍待验证；本轮没有重新构建 Windows。

继续工作须保持 Unity 为目标，按以下顺序推进，不照搬网页端文件清单：

1. P0-A：教程从真实移动事件推进；补齐按键释放、取消加载、Boss 错误恢复和输入焦点验收。现有教程仍在题目打开时推断移动和交互完成。
2. P0-B：Unity `QuizRecordRequest`、`LearningService`、队列和服务端同步增加 attemptId、encounterId、attemptPhase、assistance；旧记录归 unknown。验证请求重复及掌握度副作用幂等；纠正单独记录且不提升独立回忆统计。目前尚不具备这些服务端保证，网络响应不明后的手动重试仍有重复记录风险。
3. P0-B：统一服务器题型推荐与降级标记；按独立回忆、识别、提示、纠正分层统计，验证 24 小时延迟复习边界，再修改 Unity 报告表述。
4. P1：固定最多 10 词的今日学习会话（优先 5 个到期词），服务端会话归属和并发幂等；Unity Home 入口、跨启动恢复、完成页、词库切换和午夜边界同步实现。
5. 每个数据闭环使用隔离数据库验证，复用现有服务端契约并保持网页兼容；不对真实数据执行迁移或回填。

原网页方案的产品需求保留，但技术映射和旧网页测试不代表 Unity 实现完成。
