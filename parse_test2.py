from datetime import datetime
def getCustomWeekNumber(dt_str):
    import math
    # pretend JS parsing MM/DD/YYYY if format is DD/MM/YYYY
    parts = dt_str.split('/')
    if len(parts) == 3:
      # assume JS parses "9/4/2026" as Sep 4, 2026
      dt = datetime(int(parts[2]), int(parts[0]), int(parts[1]))
    else:
      return "0"

    dDay = dt.weekday()
    if dDay == 6: dDay = 0
    else: dDay += 1

    jan1 = datetime(dt.year, 1, 1)
    jan1Day = jan1.weekday()
    if jan1Day == 6: jan1Day = 0
    else: jan1Day += 1

    daysToFirstFri = (5 - jan1Day + 7) % 7
    import datetime as dt_module
    firstFridayDt = jan1 + dt_module.timedelta(days=daysToFirstFri)

    daysSinceFri = (dDay - 5 + 7) % 7
    currentWeekStartDt = dt - dt_module.timedelta(days=daysSinceFri)

    diffDays = round((currentWeekStartDt - firstFridayDt).total_seconds() / 86400.0)
    week = math.floor(diffDays / 7) + 1
    return week

print("9/4/2026 =>", getCustomWeekNumber("9/4/2026"))
print("04/09/2026 =>", getCustomWeekNumber("04/09/2026"))
print("10/4/2026 =>", getCustomWeekNumber("10/4/2026"))

