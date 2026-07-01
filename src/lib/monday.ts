const MONDAY_API_KEY = import.meta.env.VITE_MONDAY_API_KEY as string;
const BOARD_ID = '1215254769';
const FILMING_DATE_COLUMNS = ['date5', 'date14', 'date46', 'date__1'];

export interface MondayFilmingEvent {
  id: string;
  title: string;
  date: Date;
}

export async function fetchMondayFilmingDates(): Promise<MondayFilmingEvent[]> {
  if (!MONDAY_API_KEY) return [];

  const query = `{
    boards(ids: [${BOARD_ID}]) {
      items_page(limit: 500) {
        items {
          id
          name
          column_values(ids: ${JSON.stringify(FILMING_DATE_COLUMNS)}) {
            id
            text
          }
        }
      }
    }
  }`;

  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: MONDAY_API_KEY,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error('Monday.com API request failed');

  const json = await res.json();
  const items = json?.data?.boards?.[0]?.items_page?.items ?? [];

  const events: MondayFilmingEvent[] = [];

  for (const item of items) {
    for (const col of item.column_values as { id: string; text: string }[]) {
      if (!col.text) continue;
      const date = new Date(col.text);
      if (isNaN(date.getTime())) continue;
      events.push({
        id: `${item.id}-${col.id}`,
        title: item.name,
        date,
      });
    }
  }

  return events;
}
