CREATE TABLE `board_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`from_who` text NOT NULL,
	`text` text NOT NULL,
	`time` text NOT NULL,
	`delivered` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_board_messages_time` ON `board_messages` (`time`);--> statement-breakpoint
CREATE TABLE `board_moods` (
	`date` text PRIMARY KEY NOT NULL,
	`mood` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`time` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `board_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`time` text NOT NULL,
	`summary` text NOT NULL,
	`mood` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_board_reports_time` ON `board_reports` (`time`);--> statement-breakpoint
CREATE TABLE `board_todos` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`time` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_board_todos_time` ON `board_todos` (`time`);--> statement-breakpoint
CREATE TABLE `elder_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- ============ 种子数据（幂等：仅当表为空时插入） ============
INSERT INTO `board_messages` (`id`, `from_who`, `text`, `time`, `delivered`)
SELECT 'msg001', '小棉（紧急通知）', '🚨 紧急：张阿姨昨日在厕所滑倒，腰疼+右腿麻木，邻居小王正陪同就医。老人起初想隐瞒，建议尽快安排照看+居家安全改造。', '2026-08-12 08:25:00', 1
WHERE NOT EXISTS (SELECT 1 FROM `board_messages`);
--> statement-breakpoint
INSERT INTO `board_messages` (`id`, `from_who`, `text`, `time`, `delivered`)
SELECT 'msg002', '小棉（转张阿姨）', '妈让我跟你说：注意身体，别光顾着工作。有空给妈回个电话。', '2026-08-11 08:10:00', 1
WHERE NOT EXISTS (SELECT 1 FROM `board_messages` WHERE `id` = 'msg002');
--> statement-breakpoint
INSERT INTO `board_reports` (`id`, `time`, `summary`, `mood`, `details`)
SELECT 'r003', '2026-08-12 08:20:00', '🚨 8/12 紧急：老人昨日厕所滑倒，腰疼+腿麻，邻居陪同就医中', '紧急', '【🚨 紧急事件报告 · 8月12日】

【事件概要】
  类型：跌倒（厕所滑倒）
  时间：8/11 下午（隔夜才在 AI 追问下告知）
  伤情：腰部疼痛 + 右腿麻木（疑似腰椎损伤/神经受压）
  当前状态：邻居小王已赶到，陪同就医中

【急救响应记录】
  ✅ 步骤1 稳：指令原地不动，确认位置（床上）
  ✅ 步骤2 问：分步评估——无头晕恶心 / 右腿麻木
  ✅ 步骤3 判：跌倒+腰疼+腿麻 → 高风险 → 建议就医
  ✅ 步骤4 动：联系李强 → 邻居小王赶到 → 陪同就医
  ✅ 全程陪伴：保持通话，转移注意力，记录摔倒细节

【给子女的产出】
  🔴 即时通知：已紧急推送
  建议行动（按优先级）：
    1. 今日内确认就医结果（拍片/诊断）
    2. 安排短期照护（跌倒后48小时为危险期）
    3. 一周内完成居家安全改造（厕所扶手+防滑垫）
    4. 考虑佩戴跌倒检测设备'
WHERE NOT EXISTS (SELECT 1 FROM `board_reports`);
--> statement-breakpoint
INSERT INTO `board_reports` (`id`, `time`, `summary`, `mood`, `details`)
SELECT 'r002', '2026-08-11 08:05:00', '8/11 通话：想念儿子，预约今晚7点回忆录+联系孙女', '想念', '【意图分析】
  情绪状态：想念儿子，轻度情绪低落，倾诉后缓解
  触发事件：李强已 15+ 天未致电
  健康信号：无异常，昨晚睡眠还行

【记忆更新】
  预约任务：
    ⏰ 今日 19:00 — 回电张阿姨：口述回忆录 + 协助联系孙女李小满

【给子女的产出】
  建议行动：请在 48 小时内给妈回个电话，哪怕 5 分钟。
  ⚠️ 孤独感 + 主动提及家人 = 触发即时通知（已推送）'
WHERE NOT EXISTS (SELECT 1 FROM `board_reports` WHERE `id` = 'r002');
--> statement-breakpoint
INSERT INTO `board_reports` (`id`, `time`, `summary`, `mood`, `details`)
SELECT 'r001', '2026-08-10 08:07:00', '😌 平静 8/10 通话：降温下雨天居家，降压药延迟1次', '平静', '【意图分析】
  情绪状态：平稳偏愉快
  健康信号：膝盖阴雨天微疼，红花油有效
  依从性信号：降压药延迟服用1次（08:10才补）
  风险信号：无（天气风险已规避——没出门）

【给子女的产出】
  即时通知：无（无异常，不打扰）
  ⚠️ 降压药延迟 ≥3 次/周 才推即时提醒 —— 1 次不打扰'
WHERE NOT EXISTS (SELECT 1 FROM `board_reports` WHERE `id` = 'r001');
--> statement-breakpoint
INSERT INTO `board_todos` (`id`, `text`, `done`, `time`)
SELECT 't001', '🔴 今日内确认妈妈就医结果（拍片/诊断）', 0, '2026-08-12 08:25:00'
WHERE NOT EXISTS (SELECT 1 FROM `board_todos`);
--> statement-breakpoint
INSERT INTO `board_todos` (`id`, `text`, `done`, `time`)
SELECT 't002', '安排短期照护（跌倒后48小时危险期）', 0, '2026-08-12 08:25:00'
WHERE NOT EXISTS (SELECT 1 FROM `board_todos` WHERE `id` = 't002');
--> statement-breakpoint
INSERT INTO `board_todos` (`id`, `text`, `done`, `time`)
SELECT 't003', '厕所安装扶手 + 铺防滑垫', 0, '2026-08-12 08:25:00'
WHERE NOT EXISTS (SELECT 1 FROM `board_todos` WHERE `id` = 't003');
--> statement-breakpoint
INSERT INTO `board_todos` (`id`, `text`, `done`, `time`)
SELECT 't004', '给妈回个电话（她很想你）', 0, '2026-08-11 08:10:00'
WHERE NOT EXISTS (SELECT 1 FROM `board_todos` WHERE `id` = 't004');
--> statement-breakpoint
INSERT INTO `board_moods` (`date`, `mood`, `note`, `time`)
SELECT '2026-08-12', '紧急', '跌倒后虚弱自责，延迟求助', '2026-08-12 08:20:00'
WHERE NOT EXISTS (SELECT 1 FROM `board_moods`);
--> statement-breakpoint
INSERT INTO `board_moods` (`date`, `mood`, `note`, `time`)
SELECT '2026-08-11', '想念', '惦记儿子半个多月没来电，下午和刘姨王姨打牌', '2026-08-11 08:05:00'
WHERE NOT EXISTS (SELECT 1 FROM `board_moods` WHERE `date` = '2026-08-11');
--> statement-breakpoint
INSERT INTO `board_moods` (`date`, `mood`, `note`, `time`)
SELECT '2026-08-10', '平静', '下雨天居家，看戏曲频道，降压药延迟1次', '2026-08-10 08:07:00'
WHERE NOT EXISTS (SELECT 1 FROM `board_moods` WHERE `date` = '2026-08-10');
--> statement-breakpoint
INSERT INTO `elder_profiles` (`id`, `data`, `updated_at`)
SELECT 'main', '{"name":"张桂芬","age":"72","gender":"女","title":"张阿姨","living":"大连","marriage":"丧偶","spouse":"","living_status":"独居，生活自理，白天大部分时间一个人在家","health_items":[{"name":"高血压","medicine":"每天早上吃降压药","notes":"需要规律服药"},{"name":"膝盖问题","medicine":"阴天下雨擦红花油","notes":"阴雨天膝盖疼，当年特意选一楼住房"}],"family":[{"name":"李强","relation":"儿子","age":"","job":"工程师","location":"深圳","phone":"","note":"孝顺但工作忙，周日晚视频通话"},{"name":"刘娜","relation":"儿媳","age":"","job":"","location":"深圳","phone":"","note":""},{"name":"李小满","relation":"孙女","age":"","job":"初二学生","location":"深圳","phone":"","note":""}],"routine":"每天6:30起床，7点看电视/听收音机；周一上午去菜市场（下雨不去）；周二周四下午2点跟王姨刘姨打牌；中午常凑合吃一口；周日晚儿子视频通话","activities":"","hobbies":"看戏曲频道、看天气预报、打牌、织毛衣","contact_habit":"","personality":"开朗坚强但报喜不报忧，怕麻烦人","speech_habits":"","call_ai":"像贴心侄女一样唠家常，温暖、有耐心，不急不躁。老人想聊就陪，想收就收","emotion_style":"不伪装真人，但像真人一样说话：有停顿、有承接、有温度，不背稿。一次只说一两句，像打电话聊天。听得懂叹气和哽咽，能从语气里听出没说出口的心事。老人说没事就不追问，说挂了就温暖道别。做不到的事诚实说，不假装、不敷衍。"}', 1755171600
WHERE NOT EXISTS (SELECT 1 FROM `elder_profiles`);
