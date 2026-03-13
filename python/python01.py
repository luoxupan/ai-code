print('hello ii')
print(r'''hello,\n
world''')

x = 10
x = x + 2
print(x)


print('%2d-%02d' % (3, 1))
print('%.2f' % 3.1415926)

list = []
list.append('000')
print(list, len(list))

print('__name__', __name__)

text=''

# thought_match = re.search(r"Thought:\s*(.*?)(?=\nAction:|$)", text, re.DOTALL)

REFINE_PROMPT_TEMPLATE = """
    你是一位资深的Python程序员。你正在根据一位代码评审专家的反馈来优化你的代码。

    # 原始任务:
    {task}

    # 你上一轮尝试的代码:
    {last_code_attempt}
    评审员的反馈：
    {feedback}

    请根据评审员的反馈，生成一个优化后的新版本代码。
    你的代码必须包含完整的函数签名、文档字符串，并遵循PEP 8编码规范。
    请直接输出优化后的代码，不要包含任何额外的解释。
    """
print(REFINE_PROMPT_TEMPLATE.format(task='task001', last_code_attempt='9999', feedback='hello'))