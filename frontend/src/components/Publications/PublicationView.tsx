import { Image, Alert, AlertIcon } from "@chakra-ui/react"

import { type Publication } from "../../client"

interface PubViewProps {
  publication: Publication
}

function PublicationView({ publication }: PubViewProps) {
  let contentView = <>Not set</>
  if (
    publication.path.endsWith(".pdf") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <embed
        height="100%"
        width="100%"
        type="application/pdf"
        src={
          publication.content
            ? `data:application/pdf;base64,${publication.content}`
            : String(publication.url)
        }
      />
    )
  } else if (
    publication.path.endsWith(".html") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <embed
        height="100%"
        width="100%"
        type="text/html"
        src={
          publication.url
            ? String(publication.url)
            : `data:text/html;base64,${publication.content}`
        }
      />
    )
  } else if (
    publication.path.endsWith(".png") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <Image
        alt={publication.title}
        src={
          publication.content
            ? `data:image/png;base64,${publication.content}`
            : String(publication.url)
        }
      />
    )
  } else {
    contentView = (
      <Alert mt={2} status="warning" borderRadius="xl">
        <AlertIcon />
        No content found. Perhaps the publication hasn't been built and pushed
        yet?
      </Alert>
    )
  }
  return <>{contentView}</>
}

export default PublicationView
