import { SectionCard } from "./SectionCard"

type CardData = {
  title: string;
  price: string;
  description: string;
  rate: string;
  footer?: string;
  subFooter?: string;
  rateIcon?: React.ReactNode;
  footerIcon?: React.ReactNode;
};

type SectionCardListProps = {
  cards: CardData[];
  count?: number; // Optional: how many cards to show
};

export function SectionCardList({ cards, count }: SectionCardListProps) {
  const displayCards = count ? cards.slice(0, count) : cards;
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {displayCards.map((card, idx) => (
        <SectionCard key={idx} {...card} />
      ))}
    </div>
  );
}
