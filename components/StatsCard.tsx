interface StatsCardProps {
  title: string
  value: string | number
  description?: string
}

export default function StatsCard({ title, value, description }: StatsCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground pt-2">{description}</p>
        )}
      </div>
    </div>
  )
}
