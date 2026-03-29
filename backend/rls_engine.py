import sys
import json

def main():

    try:
        raw_data:sys.argv[1]
        data=json.loads(raw_data)
        voltage = data.get("voltage", 0)
        # 2. DUMMY MATH: Just multiply by 2 for testing
        test_result = voltage * 2
        print(json.dumps({"predicted_soc": test_result}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__=="__main__":
    main()