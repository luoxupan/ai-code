# 虚拟环境搭建方案
# ① 官方venv（新手友好）
# pythonm venv创建隔离环境
# 系统命令激活对应环境

# ② Poetry（长期项目推荐）
# 智能依赖管理+规范项目结构
# poetry add自动解析依赖树

# ③ Conda（数据科学专用）
# 预装科学计算套件
# 支持多版本环境隔离

# 创建虚拟环境 在ai-code目录执行下面命令
python3 -m venv ./python
# 激活环境（macOS/Linux） 在python目录执行下面命令
source ./bin/activate
# 退出虚拟环境
deactivate

# 导出依赖到 requirements.txt
pip3 freeze > requirements.txt
# 他人拿到项目后，先创建并激活venv，再安装依赖
pip3 install -r requirements.txt


source .venv/bin/activate
