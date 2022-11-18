###################################
# Build application
FROM public.ecr.aws/lambda/nodejs:16 as builder
WORKDIR /usr/app
COPY src  ./src
COPY package*.json ./
RUN npm install
RUN npm run build

###################################
FROM amazon/aws-cli as adotlayer
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_SESSION_TOKEN
ARG AWS_DEFAULT_REGION
ARG ADOT_LAYER_ARN
ENV AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
ENV AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ENV AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN}
ENV AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}
WORKDIR /opt
RUN yum -y install unzip && \
    curl $(aws lambda get-layer-version-by-arn --arn ${ADOT_LAYER_ARN} --query 'Content.Location' --output text) --output layer.zip && \
    unzip layer.zip && rm -f layer.zip

###################################
FROM public.ecr.aws/lambda/nodejs:16
WORKDIR /opt
COPY --from=adotlayer /opt .
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist ./dist
COPY --from=builder /usr/app/node_modules ./node_modules
CMD ["dist/index.handler"]
