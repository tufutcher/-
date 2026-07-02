# 不画画真的要完了

一个绘画创作记录与成长分析网站。

## 当前版本

v0.1.0

## 当前功能

- 注册 / 登录 / 邀请码
- 多图打卡
- 日期补档
- 图片标签
- 打卡墙
- 按人分组
- 个人主页
- 月历记录
- 创作分析
- 管理员批量管理
- 管理员清理用户数据

## 技术栈

- 原生 HTML / CSS / JavaScript
- Supabase Auth
- Supabase Database
- Supabase Storage
- GitHub Pages

## 文件结构

- api/：Supabase 数据读写
- core/：应用状态与初始化
- modules/：页面模块
- styles/：全站样式

## 本地开发

直接用 VS Code Live Server 打开 index.html。

## 注意事项

- 不要在前端放 service_role key
- 删除用户前先用管理员清理网站数据，再去 Supabase 删除 Auth 用户
- Storage 文件删除依赖 Supabase policy
