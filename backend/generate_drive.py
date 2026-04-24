import csv
import random
import math

def generate_drive_cycle():
    print("🚗 Generating Highway Drive Cycle...")

    #starting conditions
    true_soc = 100.0
    temperature = 25.0

    with open('highway_drive.csv','w',newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['cycle', 'voltage', 'current', 'temperature', 'true_soc'])

        #Simulating 1000s of drivingx``
        for second in range(1,1001):
            if second % 100 < 10:  # Hard acceleration every 100s
                current = random.uniform(-40, -50)
            elif second % 150 < 15: # Regenerative braking (Charging!)
                current = random.uniform(5, 15)
            else: # Highway cruising
                current = random.uniform(-10, -15)

            # 2. Simulate the Battery Draining
            # Drain SoC based on how much current is being pulled
            if current < 0:
                true_soc -= abs(current) * 0.002
            else:
                true_soc += current * 0.002 # Regen braking adds SoC back.
            
            # 3. Simulate the Voltage Sag (Ohm's Law)
            # Base voltage drops as SoC drops (from 14V down to 10V)
            base_voltage = 10.0 + true_soc* 0.04
            # Apply instant voltage sag based on current load (Internal Resistance = 0.05 Ohms)
            voltage = base_voltage + (current * 0.05) 
            
            # Add a tiny bit of electrical sensor noise
            voltage += random.uniform(-0.05, 0.05)
            
            # 4. Simulate Temperature rising
            temperature += abs(current) * 0.001
            
            writer.writerow([second, round(voltage, 3), round(current, 3), round(temperature, 2), round(max(0, true_soc), 2)])
        
        print("Created highway_drive.csv")


if __name__=="__main__":
    generate_drive_cycle()