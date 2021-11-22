import time

jsonData = {}

for x in range(0, 5000000):
    jsonData[str(x)] = {"name":str(x)}

print("-----")

start = time.time()
print(jsonData["1234567"])
end = time.time()
print(end - start)

print("-----")

start = time.time()
for x in jsonData:
    if x == "1234567":
        print(x)
        end = time.time()
        print(end - start)
        break

print("-----")