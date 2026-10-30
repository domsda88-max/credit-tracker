$path='C:\Users\pupup\OneDrive\Desktop\расчет для частичого досрочного погашения кредита.xlsx'
$out='C:\Users\pupup\OneDrive\Desktop\Прородитель\history.txt'
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false
$excel.DisplayAlerts=$false
$wb=$excel.Workbooks.Open($path)
$lines=@()
for($si=1;$si -le $wb.Sheets.Count;$si++){
  $ws=$wb.Sheets.Item($si)
  $lines += ("===== SHEET "+$si+": "+$ws.Name+" =====")
  $used=$ws.UsedRange
  $rows=$used.Rows.Count
  $cols=$used.Columns.Count
  for($r=1;$r -le $rows;$r++){
    $vals=@()
    for($c=1;$c -le $cols;$c++){
      $cell=$used.Cells.Item($r,$c)
      $v=$cell.Value2
      if($null -eq $v){ $v='' }
      $f=$cell.Formula
      if($f -and $f -ne $v -and $f -ne ''){ $vals += ("["+ $f + "]") } else { $vals += ([string]$v) }
    }
    $lines += ($vals -join "`t")
  }
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
$lines | Out-File -FilePath $out -Encoding utf8
Write-Host "done"