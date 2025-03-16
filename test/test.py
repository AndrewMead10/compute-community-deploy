import openai

client = openai.OpenAI(api_key="ZzQA-LEl3-s4gV-R8Mj", base_url="http://localhost:8080/v1")

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hey hows it going"}],
    # api_key="ZzQA-LEl3-s4gV-R8Mj"
)

print(response.choices[0].message.content)
