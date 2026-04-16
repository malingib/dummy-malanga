interface StatsCardProps {
  title: string
  value: string | number
  icon: string
  color: 'green' | 'blue' | 'red' | 'orange'
}

const colorClasses = {
  green: 'bg-green-100 text-green-900',
  blue: 'bg-blue-100 text-blue-900',
  red: 'bg-red-100 text-red-900',
  orange: 'bg-orange-100 text-orange-900',
}

const iconBgClasses = {
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
}

export default function StatsCard({ title, value, icon, color }: StatsCardProps) {
  return (
    <div className={`card ${colorClasses[color]} border-0`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`${iconBgClasses[color]} text-white rounded-full p-3 text-2xl w-16 h-16 flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
