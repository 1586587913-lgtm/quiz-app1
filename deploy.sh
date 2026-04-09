#!/bin/bash
# GitHub Pages 部署脚本

# 1. 构建项目
npm run build

# 2. 进入构建输出目录
cd dist

# 3. 初始化 git（如果是首次部署）
git init
git status

# 4. 添加所有文件
git add .

# 5. 提交
git commit -m "Deploy to GitHub Pages"

# 6. 设置远程仓库（需要替换为你的仓库地址）
# git remote add origin https://github.com/你的用户名/quiz-app.git

# 7. 推送到 gh-pages 分支
git push -u origin main:gh-pages --force

echo "部署完成！请在 GitHub 仓库 Settings -> Pages 中启用 Pages"
echo "访问地址: https://你的用户名.github.io/quiz-app/"
