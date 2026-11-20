/** Names are optional: the ticket number stands in as the headline when there is none. */
export const headline = (t: { ticket?: string; name?: string }) => t.name?.trim() || `Ticket ${t.ticket ?? ''}`.trim()
