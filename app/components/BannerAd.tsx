interface BannerAdProps {
  zoneId: string;
  width: number;
  height: number;
  className?: string;
}

export default function BannerAd({ zoneId, width, height, className = "" }: BannerAdProps) {
  const script = `<script type="text/javascript">var t=setInterval(function(){if(window.aclib){clearInterval(t);aclib.runBanner({zoneId:'${zoneId}'});}},100);<\/script>`;
  return (
    <div
      style={{ width, height, overflow: "hidden", flexShrink: 0 }}
      className={className}
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
