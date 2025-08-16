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

// Define the interface for a single card detail
interface CardDetail {
  title: string;
  value: string;
  change: string;
  changeIcon: React.ReactNode;
  description: string;
  footerText: string;
}

// Define the props interface for the component
interface SectionCardsProps {
  details: CardDetail[];
}

export function SectionCards({ details }: SectionCardsProps) {
  return (
    <div className="*:data-[slot=card]:from-primary/4 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {details.map((detail, index) => (
        <Card className="" key={index}>
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

// Export the interface so it can be used in parent components
export type { CardDetail };