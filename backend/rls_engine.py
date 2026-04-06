import sys
import json
import os

URL = "http://localhost:5000/api/predict"


def create_square_matrix(n):
    return [[1000 if i == j else 0 for j in range(n)] for i in range(n)]

def create_column_matrix(rows):
    return [[0] for _ in range(rows)]

def create_design_matrix(file_path):
    design_matrix = []
    try:
        with open(file_path, 'r') as file:
            lines = file.readlines()
            for line in lines[1:]:  # Skipping header
                values = line.strip().split(',')
                # bias, voltage, current, temperature, actual_soc
                row = [1] + [float(value) for value in values[1:4]] + [float(values[-1])]
                design_matrix.append(row)
    except FileNotFoundError:
        # Failsafe if CSV is missing
        print(json.dumps({"error": f"File {file_path} not found."}))
        sys.exit(1)
    return design_matrix

def mat_mult(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(len(A[0]))) for j in range(len(B[0]))] for i in range(len(A))]

def transpose(M):
    return [[M[i][j] for i in range(len(M))] for j in range(len(M[0]))]

def matrix_sub(A, B):
    return [[A[i][j] - B[i][j] for j in range(len(A[0]))] for i in range(len(A))]

def scalar_multiply_matrix(scalar, M):
    return [[scalar * M[i][j] for j in range(len(M[0]))] for i in range(len(M))]

def iterative_update(design_matrix, P, W):
    for i, row in enumerate(design_matrix):
        beta = [[float(val)] for val in row[:-1]]
        y = float(row[-1])
        
        P_beta = mat_mult(P, beta)
        betaT = transpose(beta)
        denominator = max(1e-6, 1 + mat_mult(betaT, P_beta)[0][0])
        K = scalar_multiply_matrix(1 / denominator, P_beta)
        error = y - mat_mult(betaT, W)[0][0]
        
        W = [[W[i][0] + K[i][0] * error] for i in range(len(W))]
        P = matrix_sub(P, mat_mult(K, mat_mult(betaT, P)))
    return W, P

def predict_soc(voltage, current, temperature, weights):
    # bias, voltage, current, temperature
    input_vector = [[1], [voltage], [current], [temperature]]
    return mat_mult(transpose(weights), input_vector)[0][0]


def main():

    try:
        raw_data=sys.argv[1]
        data=json.loads(raw_data)

        voltage = data.get("voltage", 12.0)
        current= data.get("current",0)
        temperature= data.get("temperature",25)
        
        d = 4 
        P0 = create_square_matrix(d)
        W0 = create_column_matrix(d)

        script_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(script_dir, "highway_drive.csv")

        design_matrix = create_design_matrix(file_path)
        final_weights, final_P = iterative_update(design_matrix, P0, W0)

        predicted_soc = predict_soc(voltage, current, temperature, final_weights)
        # Cap the SoC between 0% and 100% just in case the math gets wild
        predicted_soc = max(0.0, min(100.0, predicted_soc))

        print(json.dumps({"predicted_soc": round(predicted_soc, 2)}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__=="__main__":
    main()