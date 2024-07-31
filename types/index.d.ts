export type Data = [SellerPageLinks] | []

export type SellerPageLinks = {
  url: string,
  links: Array<string>
}

export type Product = {
  title: string,
  price: string,
  images: Array<Image>,
  params: Array<Param>,
  additionalParams?: Array<ParamBlock>,
  description?: string
}

export type Image = {
  url: string
}

export type Param = {
  name: string,
  value: string
}

export type ParamBlock = {
  name: string,
  params: Array<Param>
}