import sys
import json

def main():

    try:
        raw_data=sys.argv[1]
        data=json.loads(raw_data)
        voltage = data.get("voltage", 0)
        current= data.get("current",0)
        temperature= data.get("temperature",25)
        # DUMMY MATH: We will put the real RLS matrix math here later.
        # For now, let's just make a fake calculation using all three!
        test_result = (voltage * 2) + current - (temperature * 0.1)
        print(json.dumps({"predicted_soc": test_result}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__=="__main__":
    main()