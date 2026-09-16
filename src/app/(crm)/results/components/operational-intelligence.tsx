import type { OperationalResults } from "../../../../../server/analytics/operational-results";

const weekdayLabels: Record<string, string> = {
  Mon: "Пн",
  Tue: "Вт",
  Wed: "Ср",
  Thu: "Чт",
  Fri: "Пт",
  Sat: "Сб",
  Sun: "Вс",
};

function percent(value: number | null) {
  return value === null ? "Нет данных" : `${value.toFixed(1)}%`;
}

function minutes(value: number | null) {
  return value === null ? "Нет данных" : `${Math.round(value)} мин`;
}

export function OperationalIntelligence({ data }: { data: OperationalResults }) {
  return (
    <section aria-labelledby="operational-results-title" className="mt-8 space-y-4">
      <div>
        <h2 id="operational-results-title" className="font-bold text-xl">
          Обработка заявок на товары
        </h2>
        <p className="text-muted-foreground text-sm">
          Доля DONE считается среди заявок, созданных в выбранном периоде. Открытые заявки остаются в знаменателе; это
          не конверсия посетителей сайта. Статус может измениться позже.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Доля завершённых заявок</h3>
          <p className="mt-2 font-bold text-2xl">{percent(data.current.completionRate)}</p>
          <p className="text-muted-foreground text-sm">
            {data.current.completed} из {data.current.applications} сейчас · {percent(data.previous.completionRate)}{" "}
            ранее
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Среднее время до первого действия</h3>
          <p className="mt-2 font-bold text-2xl">{minutes(data.current.averageFirstActionMinutes)}</p>
          <p className="text-muted-foreground text-sm">
            {data.current.measuredFirstActions} измерено · {data.current.missingFirstActions} без достоверной отметки;
            ранее {minutes(data.previous.averageFirstActionMinutes)}
          </p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border bg-white p-4">
          <h3 className="mb-2 font-semibold">Заявки по дню недели · Кишинёв</h3>
          <table className="w-full min-w-[300px] text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-2">
                  День
                </th>
                <th scope="col">Всего</th>
                <th scope="col">DONE</th>
              </tr>
            </thead>
            <tbody>
              {data.weekdays.map((day) => (
                <tr key={day.day} className="border-t">
                  <th scope="row" className="py-2 font-medium">
                    {weekdayLabels[day.day]}
                  </th>
                  <td>{day.applications}</td>
                  <td>{day.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-white p-4">
          <h3 className="mb-2 font-semibold">Доля DONE по региону заявки</h3>
          {data.regions.length > 0 && (
            <p className="mb-2 text-muted-foreground text-xs sm:hidden">
              Прокрутите таблицу вправо, чтобы увидеть долю.
            </p>
          )}
          {data.regions.length ? (
            <table className="w-full min-w-[430px] text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="py-2">
                    Регион
                  </th>
                  <th scope="col">Заявки</th>
                  <th scope="col">DONE</th>
                  <th scope="col">Доля</th>
                </tr>
              </thead>
              <tbody>
                {data.regions.map((region) => (
                  <tr key={region.name} className="border-t">
                    <th scope="row" className="py-2 font-medium">
                      {region.name}
                    </th>
                    <td>{region.applications}</td>
                    <td>{region.completed}</td>
                    <td>{percent(region.completionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground text-sm">В выбранном периоде заявок на товары нет.</p>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Среднее время учитывает только заявки с сохранённой отметкой первого действия. Для исторических записей без
        отметки время неизвестно. Регион берётся из исходной заявки, а не из текущей карточки клиента.
      </p>
    </section>
  );
}
