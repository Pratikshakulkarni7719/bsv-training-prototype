// Spreadsheet import and export. SheetJS is loaded only when needed to keep the first page fast.

const ACCEPTED = ['.xlsx', '.xls', '.csv']
export const MAX_IMPORT_MB = 5

export function checkSpreadsheet(file) {
  const name = file.name.toLowerCase()
  if (!ACCEPTED.some((ext) => name.endsWith(ext))) return 'Choose an Excel (.xlsx, .xls) or CSV file.'
  if (file.size > MAX_IMPORT_MB * 1024 * 1024) return `The file is larger than ${MAX_IMPORT_MB} MB.`
  if (!file.size) return 'The file is empty.'
  return ''
}

// Reads the first sheet into an array of { header: value } rows
export async function readSpreadsheet(file) {
  const XLSX = await import('xlsx')
  const data = await file.arrayBuffer()
  const book = XLSX.read(data, { type: 'array', raw: false })
  const sheet = book.Sheets[book.SheetNames[0]]
  if (!sheet) return []
  return XLSX.utils
    .sheet_to_json(sheet, { defval: '', raw: false })
    .filter((row) => Object.values(row).some((v) => String(v).trim() !== ''))
}

// sheets: [{ name, rows: [{ column: value }] }]
export async function downloadWorkbook(fileName, sheets) {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  sheets.forEach(({ name, rows }) => {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No data' }])
    XLSX.utils.book_append_sheet(book, sheet, name.slice(0, 31))
  })
  XLSX.writeFile(book, fileName)
}

export function downloadSampleEmployeeFile() {
  return downloadWorkbook('bsv_employee_list_sample.xlsx', [
    {
      name: 'Employees',
      rows: [
        { 'Employee ID': 'BSV5001', Name: 'Meera Sawant', 'WhatsApp number': '+91 98220 15001', Region: 'West', Designation: 'Medical Representative', Manager: 'Sunil Wagh', Language: 'Marathi' },
        { 'Employee ID': 'BSV5002', Name: 'Rohit Naik', 'WhatsApp number': '9822015002', Region: 'West', Designation: 'Medical Representative', Manager: 'Amit Kulkarni', Language: 'English' },
        { 'Employee ID': 'BSV5003', Name: 'Asha Pillai', 'WhatsApp number': '98220', Region: 'South', Designation: 'Medical Representative', Manager: 'Divya Nair', Language: 'English' },
        { 'Employee ID': 'BSV1004', Name: 'Sneha Joshi', 'WhatsApp number': '+91 98220 11004', Region: 'West', Designation: 'Area Manager', Manager: 'Rekha Iyer', Language: 'Marathi' }
      ]
    }
  ])
}

// A ready-made HR file so the import can be tried without a real spreadsheet
export function sampleImportRows(employees) {
  const rows = employees
    .filter((e) => e.status === 'Active' && !['BSV1010', 'BSV4003'].includes(e.empId))
    .map((e) => ({
      'Employee ID': e.empId,
      Name: e.name,
      'WhatsApp number': e.phone,
      Region: e.region,
      Designation: e.empId === 'BSV1004' ? 'Area Manager' : e.designation,
      Manager: e.manager,
      Language: e.language
    }))
  rows.push(
    { 'Employee ID': 'BSV5001', Name: 'Meera Sawant', 'WhatsApp number': '+91 98220 15001', Region: 'West', Designation: 'Medical Representative', Manager: 'Sunil Wagh', Language: 'Marathi' },
    { 'Employee ID': 'BSV5002', Name: 'Rohit Naik', 'WhatsApp number': '9822015002', Region: 'West', Designation: 'Medical Representative', Manager: 'Amit Kulkarni', Language: 'English' },
    { 'Employee ID': 'BSV5003', Name: 'Asha Pillai', 'WhatsApp number': '98220', Region: 'South', Designation: 'Medical Representative', Manager: 'Divya Nair', Language: 'English' },
    { 'Employee ID': 'BSV5004', Name: 'Imran Shaikh', 'WhatsApp number': '+91 98220 15004', Region: 'West', Designation: 'Medical Representative', Manager: 'Sunil Wagh', Language: 'Urdu' },
    { 'Employee ID': 'BSV5005', Name: 'Kiran Rao', 'WhatsApp number': '+91 98220 15001', Region: 'South', Designation: 'Medical Representative', Manager: 'Divya Nair', Language: 'English' },
    { 'Employee ID': 'BSV3005', Name: 'Farah Khan', 'WhatsApp number': '+91 98450 33005', Region: 'South', Designation: 'Medical Representative', Manager: 'Divya Nair', Language: 'English' },
    { 'Employee ID': '', Name: 'Unknown Person', 'WhatsApp number': '+91 98220 15009', Region: 'East', Designation: '', Manager: '', Language: '' }
  )
  return rows
}
