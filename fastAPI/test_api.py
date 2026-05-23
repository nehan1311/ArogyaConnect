import requests

# The endpoint created in main.py
url = "http://127.0.0.1:8000/predict"

# Simulate different user inputs
test_cases = [
    {"symptoms": "mild headache and a slight cough"},
    {"symptoms": "severe chest pain radiating to left arm, shortness of breath, sweating"},
    {"symptoms": "high fever, body ache, loss of taste"}
]

print("Testing Telehealth Risk Triage API...")

for i, test in enumerate(test_cases, 1):
    print(f"\n--- Test Case {i} ---")
    print(f"Input: {test['symptoms']}")
    
    try:
        # Send POST request with JSON payload
        response = requests.post(url, json=test)
        response.raise_for_status() # Catches HTTP errors (like 404 or 500)
        
        # Parse the JSON response
        data = response.json()
        print(f"Prediction: {data['risk_level'].upper()} Risk")
        
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect. Is the FastAPI server running?")
    except Exception as e:
        print(f"Error: {e}")