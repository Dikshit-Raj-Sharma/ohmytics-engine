const fs = require("fs");
const csv = require("csv-parser");

const URL = "http://localhost:5000/api/predict";

async function streamData() {
  const rows = [];

  fs.createReadStream("highway_drive.csv")
    .pipe(csv())
    .on("data", (data) => rows.push(data))
    .on("end", async () => {
      for (const row of rows) {
        const payload = {
          battery_id: 1,
          voltage: parseFloat(row.voltage),
          current: parseFloat(row.current),
          temperature: parseFloat(row.temperature),
          true_soc: parseFloat(row.true_soc),
        };
        try{
            const response= await fetch(URL,{
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload) 
            });
            const resData = await response.json();
        }
        catch(error){
            console.error('Server Error',error.message);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    });
}
streamData();
