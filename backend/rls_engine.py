import sys
import json

def mat_mult(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(len(A[0]))) for j in range(len(B[0]))] for i in range(len(A))]

def transpose(M):
    return [[M[i][j] for i in range(len(M))] for j in range(len(M[0]))]

def matrix_sub(A, B):
    return [[A[i][j] - B[i][j] for j in range(len(A[0]))] for i in range(len(A))]

def scalar_multiply_matrix(scalar, M):
    return [[scalar * M[i][j] for j in range(len(M[0]))] for i in range(len(M))]

def main():
    try:
        raw_data = sys.argv[1]
        data = json.loads(raw_data)

        voltage = data.get("voltage", 12.0)
        current = data.get("current", 0.0)
        temperature = data.get("temperature", 25.0)
        true_soc = data.get("true_soc", 50.0) 
        W = data.get("W", [[50.0], [0.0], [0.0], [0.0]])
        P = data.get("P", [[1000,0,0,0],[0,1000,0,0],[0,0,1000,0],[0,0,0,1000]])

        beta = [[1], [voltage], [current], [temperature]]

        predicted_soc = mat_mult(transpose(W), beta)[0][0]
        predicted_soc = max(0.0, min(100.0, predicted_soc))

        lam = 0.98
        P_beta      = mat_mult(P, beta)
        betaT       = transpose(beta)
        denominator = max(1e-6, 1 + mat_mult(betaT, P_beta)[0][0])
        K           = scalar_multiply_matrix(1 / denominator, P_beta)
        error       = true_soc - mat_mult(betaT, W)[0][0]
        new_W       = [[W[i][0] + K[i][0] * error] for i in range(len(W))]
        P_sub       = matrix_sub(P, mat_mult(K, mat_mult(betaT, P)))
        new_P       = scalar_multiply_matrix(1.0 / lam, P_sub)

        prev_voltage = data.get("prev_voltage", None)
        prev_current = data.get("prev_current", None)

        r_internal = None
        if prev_voltage is not None and prev_current is not None:
            delta_i = current - prev_current
            delta_v = voltage - prev_voltage
            if abs(delta_i) > 1.0:
                r_calc = -delta_v / delta_i
                if 0.001 < r_calc < 0.5: 
                    r_internal = round(r_calc, 4)

        print(json.dumps({
            "predicted_soc": round(predicted_soc, 2),
            "new_W":         new_W,
            "new_P":         new_P,
            "r_internal":    r_internal,
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()