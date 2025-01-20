import {
  Box,
  Spinner,
  Flex,
  Heading,
  Text,
  useColorModeValue,
  IconButton,
  Link,
  Code,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { FaSync } from "react-icons/fa"

import Markdown from "../../../../../components/Common/Markdown"
import useProject from "../../../../../hooks/useProject"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/repro",
)({
  component: Repro,
})

function Repro() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { userName, projectName } = Route.useParams()
  const { reproCheckRequest, putDevcontainerMutation } = useProject(
    userName,
    projectName,
    false,
  )
  const reproCheck = reproCheckRequest.data

  return (
    <>
      <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor} width="50%">
        <Flex>
          <Heading size="md" mb={2}>
            Reproducibility check
          </Heading>
          <IconButton
            aria-label="Refresh repro check"
            height="25px"
            width="28px"
            ml={1.5}
            icon={<FaSync />}
            size={"xs"}
            onClick={() => reproCheckRequest.refetch()}
          />
        </Flex>
        {reproCheckRequest.isPending ||
        reproCheckRequest.isRefetching ||
        putDevcontainerMutation.isPending ? (
          <Flex justify="center" align="center" height="100px" width="full">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          <>
            <Text>Has README.md: {reproCheck?.has_readme ? "✅" : "❌"}</Text>
            <Text>
              README.md has instructions:{" "}
              {reproCheck?.instructions_in_readme ? "✅" : "❌"}
            </Text>
            <Text>
              DVC initialized: {reproCheck?.is_dvc_repo ? "✅" : "❌"}
            </Text>
            <Text>
              DVC remote defined: {reproCheck?.n_dvc_remotes ? "✅" : "❌"}
            </Text>
            <Text>
              Has pipeline (<Code>dvc.yaml</Code>):{" "}
              {reproCheck?.has_pipeline ? "✅" : "❌"}
            </Text>
            <Text>
              Has Calkit metadata (<Code>calkit.yaml</Code>):{" "}
              {reproCheck?.has_calkit_info ? "✅" : "❌"}
            </Text>
            <Text>
              Has dev container spec:{" "}
              {reproCheck?.has_dev_container ? (
                "✅"
              ) : (
                <>
                  {"❌ "}
                  <Link onClick={() => putDevcontainerMutation.mutate()}>
                    🔧
                  </Link>
                </>
              )}
            </Text>
            <Text>
              Environments defined:{" "}
              {reproCheck ? (
                <>
                  {reproCheck.n_environments}{" "}
                  {reproCheck.n_environments ? "✅" : "❌"}
                </>
              ) : (
                ""
              )}
            </Text>
            <Text>
              Pipeline stages run in an environment:{" "}
              {reproCheck ? (
                <>
                  {reproCheck.n_stages_with_env}/{reproCheck.n_stages}{" "}
                  {reproCheck.n_stages_without_env ? "❌" : "✅"}
                </>
              ) : (
                ""
              )}
            </Text>
            <Text>
              Datasets imported or created by pipeline:{" "}
              {reproCheck ? (
                <>
                  {reproCheck.n_datasets_with_import_or_stage}/
                  {reproCheck.n_datasets}{" "}
                  {reproCheck.n_datasets_no_import_or_stage ? "❌" : "✅"}
                </>
              ) : (
                ""
              )}
            </Text>
            <Text>
              Figures imported or created by pipeline:{" "}
              {reproCheck ? (
                <>
                  {reproCheck.n_figures_with_import_or_stage}/
                  {reproCheck.n_figures}{" "}
                  {reproCheck.n_figures_no_import_or_stage ? "❌" : "✅"}
                </>
              ) : (
                ""
              )}
            </Text>
            <Text>
              Publications imported or created by pipeline:{" "}
              {reproCheck ? (
                <>
                  {reproCheck.n_publications_with_import_or_stage}/
                  {reproCheck.n_publications}{" "}
                  {reproCheck.n_publications_no_import_or_stage ? "❌" : "✅"}
                </>
              ) : (
                ""
              )}
            </Text>
            <Heading
              size="sm"
              mt={4}
              mb={-2}
              color={reproCheck?.recommendation ? "yellow.500" : "green.500"}
            >
              Recommendation
            </Heading>
            {reproCheck?.recommendation ? (
              <>
                <Markdown>{reproCheck.recommendation}</Markdown>
              </>
            ) : (
              <Markdown>
                This project looks good from here! Check in depth locally with
                `calkit status` and `calkit run`.
              </Markdown>
            )}
          </>
        )}
      </Box>
    </>
  )
}
