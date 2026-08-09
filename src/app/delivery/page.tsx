export default function DeliveryPage() {
  return (
    <>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
      </div>
      <div className="bg-muted/50 flex min-h-[50vh] flex-1 items-center justify-center rounded-xl">
        <p className="text-muted-foreground text-sm">Todavía no hay nada acá.</p>
      </div>
    </>
  );
}
