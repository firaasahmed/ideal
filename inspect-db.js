const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'ideal-pos.sqlite');

async function inspectDatabase() {
  console.log("🔍 Reading Database...\n");

  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });
  
  if (!fs.existsSync(dbPath)) {
    console.log("ERROR: ideal-pos.sqlite does not exist!");
    return;
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);
  
  try {
    
    const tablesQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    
    if (tablesQuery.length === 0) {
      console.log("Database is completely empty (No tables found).");
      return;
    }

    const tableNames = tablesQuery[0].values.map(row => row[0]);

    
    for (const tableName of tableNames) {
      console.log(`\n TABLE: \x1b[36m${tableName}\x1b[0m`); 
      
      const res = db.exec(`SELECT * FROM ${tableName}`);
      
      if (res.length === 0) {
        console.log("   (Table is empty)");
      } else {
        
        const columns = res[0].columns;
        const formattedRows = res[0].values.map(rowArray => {
          let rowObject = {};
          columns.forEach((colName, index) => {
            rowObject[colName] = rowArray[index];
          });
          return rowObject;
        });
        
        console.table(formattedRows);
      }
    }
  } catch (err) {
    console.log("SQL Error:", err.message);
  }
}

inspectDatabase();