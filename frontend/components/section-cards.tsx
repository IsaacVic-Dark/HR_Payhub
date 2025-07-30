import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  const details = [
    {
      title: "Company expenses",
      value: "Kshs 1,250.00",
      change: "+12.5%",
      changeIcon: <IconTrendingUp className="text-green-500 size-3" />,
      description: "Trending up this month",
      footerText: "Visitors for the last 6 months",
    },
    {
      title: "Monthly Payroll",
      value: "Kshs 45,678",
      change: "+12.5%",
      changeIcon: <IconTrendingUp className="text-green-500 size-3" />,
      description: "Strong user retention",
      footerText: "Engagement exceed targets",
    },
    {
      title: "Total Employees",
      value: "1,234",
      change: "-20%",
      changeIcon: <IconTrendingDown className="size-4 text-red-500" />,
      description: "Down 20% this period",
      footerText: "Acquisition needs attention",
    },
    {
      title: "Total Leaves",
      value: "230",
      change: "+4.5%",
      changeIcon: <IconTrendingUp className="size-4 text-green-500" />,
      description: "Steady performance increase",
      footerText: "Meets growth projections",
    }
  ];
  return (
    <div className="*:data-[slot=card]:from-primary/4 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      { details.map((detail, index) => (
      <Card className="">
        <CardHeader className="pb-0">
          <CardDescription className="text-xs">{detail.title}</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {detail.value}
          </CardTitle>
          <CardAction>
            <Badge className="text-xs px-2 py-1">
              <IconTrendingUp className="text-green-500 size-3"/>
              {detail.change}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 items-center flex gap-1.5 font-medium">
            {detail.description} {detail.changeIcon}
          </div>
          <div className="text-muted-foreground">{detail.footerText}</div>
        </CardFooter>
      </Card>
      ))}
    </div>
  )
}
