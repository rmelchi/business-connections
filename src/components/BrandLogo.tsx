import "./brand.css";

type BrandLogoProps = {
  size?: "medium" | "large";
};

export function BrandLogo({ size = "medium" }: BrandLogoProps) {
  return (
    <img
      src="https://italiancommerce.org/resources/Pictures/icons/logo1.png"
      alt="Italian Commerce Association"
      className={`brand-logo brand-logo--${size}`}
    />
  );
}
