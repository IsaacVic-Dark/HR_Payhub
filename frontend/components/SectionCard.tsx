// components/SectionCard.tsx
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type SectionCardProps = {
  title: string;
  price: string;
  description: string;
  rate: string;
  footer?: string;
  subFooter?: string;
  icon?: React.ReactNode;
  rateIcon?: React.ReactNode;
  footerIcon?: React.ReactNode;
};

export function SectionCard({
  title,
  price,
  description,
  rate,
  footer,
  subFooter,
  icon,
  rateIcon,
  footerIcon,
}: SectionCardProps) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          Kshs {price}
        </CardTitle>
        <CardAction>
          <Badge>
            {rateIcon}
            {rate}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {footer} {footerIcon}
        </div>
        <div className="text-muted-foreground">
          {subFooter}
        </div>
      </CardFooter>
    </Card>
  )
}
