import sys
import json

def apply_iir_filter(raw_sensor_value, previous_filtered_value, alpha=0.05):
    # If this is the very first second (n=0), we have no previous memory
    if previous_filtered_value is None:
        return raw_sensor_value
        
    # The Difference Equation: y[n] = a*x[n] + (1-a)*y[n-1]
    filtered_output = (alpha * raw_sensor_value) + ((1.0 - alpha) * previous_filtered_value)
    return filtered_output

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

        # 1. Grab the physics data
        voltage = data.get("voltage", 12.0)
        current = data.get("current", 0.0)
        temperature = data.get("temperature", 25.0)
        true_soc = data.get("true_soc", 50.0) 
        
        # 2. Grab the Brain State (Memory) from Node
        W = data.get("W", [[50.0], [0.0], [0.0], [0.0]])
        P = data.get("P", [[1000,0,0,0],[0,1000,0,0],[0,0,1000,0],[0,0,0,1000]])

        use_filter = data.get("use_dsp_filter", False)
        last_v = data.get("last_v", None)
        last_i = data.get("last_i", None)

        if use_filter:
            v_filtered = apply_iir_filter(voltage, last_v, alpha=0.05)
            i_filtered = apply_iir_filter(current, last_i, alpha=0.05)
        else:
            v_filtered = voltage
            i_filtered = current

        input_vector = [[1], [v_filtered], [i_filtered], [temperature]]
        predicted_soc = mat_mult(transpose(W), input_vector)[0][0]
        predicted_soc = max(0.0, min(100.0, predicted_soc))

        beta = [[1], [v_filtered], [i_filtered], [temperature]]
        y = true_soc # The truth we are trying to learn
        
        lam=0.98
        P_beta = mat_mult(P, beta)
        betaT = transpose(beta)
        denominator = max(1e-6, 1 + mat_mult(betaT, P_beta)[0][0])
        K = scalar_multiply_matrix(1 / denominator, P_beta)
        
        error = y - mat_mult(betaT, W)[0][0]
        
        new_W = [[W[i][0] + K[i][0] * error] for i in range(len(W))]
        P_sub = matrix_sub(P, mat_mult(K, mat_mult(betaT, P)))
        new_P = scalar_multiply_matrix(1.0 / lam, P_sub)

        print(json.dumps({
            "predicted_soc": round(predicted_soc, 2),
            "new_W": new_W,
            "new_P": new_P,
            "filtered_v": v_filtered,
            "filtered_i": i_filtered
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()