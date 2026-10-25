import json
import sys
import time

mode = json.loads(sys.stdin.readline()).get("mode")
if mode == "overflow":
    sys.stdout.write("x" * 200000)
    sys.stdout.flush()
elif mode == "stderr-overflow":
    sys.stderr.write("x" * 200000)
    sys.stderr.flush()
elif mode == "wait":
    time.sleep(10)
else:
    print(json.dumps({"fromRow": 0, "fromCol": 0, "toRow": 1, "toCol": 0}))
